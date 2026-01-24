"""
RabbitMQ-based event bus for inter-module communication.

Usage:
    from elements_common.events import EventBus, EventType

    # Initialize
    event_bus = EventBus("amqp://guest:guest@localhost:5672/", "hr")
    await event_bus.connect()

    # Publish event
    await event_bus.publish(EventType.HR_EMPLOYEE_CREATED, {
        "employee_id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe"
    })

    # Subscribe to events
    @event_bus.subscribe("hr.employee.*")
    async def handle_employee_events(event: ElementsEvent):
        print(f"Received: {event.event_type}")

    # Start consuming
    await event_bus.start_consuming()
"""

import asyncio
import fnmatch
import json
import logging
from datetime import datetime
from typing import Any, Callable, Coroutine
from uuid import uuid4

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message
from aio_pika.abc import AbstractIncomingMessage

from elements_common.events.schemas import ElementsEvent

logger = logging.getLogger(__name__)


class EventBus:
    """RabbitMQ-based event bus for Elements Platform."""

    EXCHANGE_NAME = "elements.events"

    def __init__(self, rabbitmq_url: str, module_name: str):
        """
        Initialize event bus.

        Args:
            rabbitmq_url: RabbitMQ connection URL (amqp://user:pass@host:port/)
            module_name: Name of this module (hr, it, finance)
        """
        self.rabbitmq_url = rabbitmq_url
        self.module_name = module_name
        self.connection = None
        self.channel = None
        self.exchange = None
        self.queue = None
        self._handlers: dict[str, list[Callable]] = {}
        self._connected = False

    async def connect(self) -> None:
        """Connect to RabbitMQ and set up exchange/queue."""
        if self._connected:
            return

        try:
            self.connection = await aio_pika.connect_robust(
                self.rabbitmq_url,
                client_properties={"connection_name": f"elements-{self.module_name}"},
            )
            self.channel = await self.connection.channel()

            # Declare topic exchange for events
            self.exchange = await self.channel.declare_exchange(
                self.EXCHANGE_NAME, ExchangeType.TOPIC, durable=True
            )

            # Declare queue for this module
            self.queue = await self.channel.declare_queue(
                f"elements.{self.module_name}.events", durable=True
            )

            self._connected = True
            logger.info(
                f"[EventBus] Connected to RabbitMQ as module '{self.module_name}'"
            )

        except Exception as e:
            logger.error(f"[EventBus] Failed to connect to RabbitMQ: {e}")
            raise

    async def disconnect(self) -> None:
        """Disconnect from RabbitMQ."""
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            self._connected = False
            logger.info("[EventBus] Disconnected from RabbitMQ")

    async def publish(
        self, event_type: str, data: dict[str, Any], correlation_id: str | None = None
    ) -> str:
        """
        Publish event to the bus.

        Args:
            event_type: Event type (e.g., "hr.employee.created")
            data: Event data payload
            correlation_id: Optional correlation ID for tracking

        Returns:
            Event ID
        """
        if not self._connected:
            await self.connect()

        event = ElementsEvent(
            event_id=str(uuid4()),
            event_type=event_type,
            source_module=self.module_name,
            timestamp=datetime.utcnow(),
            correlation_id=correlation_id or str(uuid4()),
            data=data,
        )

        message = Message(
            body=event.model_dump_json().encode(),
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
            message_id=event.event_id,
            correlation_id=event.correlation_id,
            timestamp=event.timestamp,
        )

        await self.exchange.publish(message, routing_key=event_type)
        logger.info(f"[EventBus] Published event: {event_type} (id={event.event_id})")

        return event.event_id

    def subscribe(self, event_pattern: str):
        """
        Decorator to subscribe to events matching pattern.

        Args:
            event_pattern: Event pattern with wildcards (* for single word, # for multiple)
                          e.g., "hr.employee.*", "hr.#", "*.*.created"

        Usage:
            @event_bus.subscribe("hr.employee.*")
            async def handle_employee_events(event: ElementsEvent):
                pass
        """

        def decorator(handler: Callable[[ElementsEvent], Coroutine]):
            if event_pattern not in self._handlers:
                self._handlers[event_pattern] = []
            self._handlers[event_pattern].append(handler)
            logger.info(f"[EventBus] Subscribed handler to pattern: {event_pattern}")
            return handler

        return decorator

    def add_handler(
        self, event_pattern: str, handler: Callable[[ElementsEvent], Coroutine]
    ) -> None:
        """
        Add event handler programmatically.

        Args:
            event_pattern: Event pattern
            handler: Async handler function
        """
        if event_pattern not in self._handlers:
            self._handlers[event_pattern] = []
        self._handlers[event_pattern].append(handler)
        logger.info(f"[EventBus] Added handler for pattern: {event_pattern}")

    async def start_consuming(self) -> None:
        """Start consuming events. Blocks until stopped."""
        if not self._connected:
            await self.connect()

        # Bind queue to patterns
        for pattern in self._handlers.keys():
            # Convert fnmatch pattern to AMQP pattern
            amqp_pattern = pattern.replace("*", "*").replace("#", "#")
            await self.queue.bind(self.exchange, routing_key=amqp_pattern)
            logger.info(f"[EventBus] Bound queue to pattern: {amqp_pattern}")

        logger.info(
            f"[EventBus] Starting to consume events for module '{self.module_name}'"
        )

        async with self.queue.iterator() as queue_iter:
            async for message in queue_iter:
                await self._process_message(message)

    async def start_consuming_background(self) -> asyncio.Task:
        """Start consuming events in background task."""
        return asyncio.create_task(self.start_consuming())

    async def _process_message(self, message: AbstractIncomingMessage) -> None:
        """Process incoming message."""
        async with message.process():
            try:
                event = ElementsEvent.model_validate_json(message.body)
                logger.debug(f"[EventBus] Received event: {event.event_type}")

                # Find matching handlers
                for pattern, handlers in self._handlers.items():
                    if self._match_pattern(pattern, event.event_type):
                        for handler in handlers:
                            try:
                                await handler(event)
                            except Exception as e:
                                logger.error(
                                    f"[EventBus] Handler error for {event.event_type}: {e}"
                                )

            except Exception as e:
                logger.error(f"[EventBus] Failed to process message: {e}")

    @staticmethod
    def _match_pattern(pattern: str, event_type: str) -> bool:
        """
        Match event type against pattern.

        Supports:
        - * matches single word (e.g., hr.*.created matches hr.employee.created)
        - # matches zero or more words (e.g., hr.# matches hr.employee.created)
        """
        # Convert AMQP-style pattern to fnmatch pattern
        fnmatch_pattern = pattern.replace(".", "/").replace("#", "**").replace("*", "*")
        event_path = event_type.replace(".", "/")

        # Simple pattern matching
        pattern_parts = pattern.split(".")
        event_parts = event_type.split(".")

        if "#" in pattern:
            # # matches everything after it
            prefix_parts = pattern.split("#")[0].rstrip(".").split(".")
            if prefix_parts == [""]:
                return True
            return event_parts[: len(prefix_parts)] == prefix_parts

        if len(pattern_parts) != len(event_parts):
            return False

        for p, e in zip(pattern_parts, event_parts):
            if p == "*":
                continue
            if p != e:
                return False

        return True


# Convenience function for creating event bus
def create_event_bus(rabbitmq_url: str, module_name: str) -> EventBus:
    """Create and return EventBus instance."""
    return EventBus(rabbitmq_url, module_name)
