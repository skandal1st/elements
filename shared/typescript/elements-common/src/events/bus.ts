/**
 * RabbitMQ-based event bus for inter-module communication.
 *
 * Usage:
 *   import { EventBus, EventType } from '@elements/common';
 *
 *   const eventBus = new EventBus('amqp://user:pass@rabbitmq:5672/', 'it');
 *   await eventBus.connect();
 *
 *   // Publish event
 *   await eventBus.publish(EventType.IT_TICKET_CREATED, { ticket_id: '123' });
 *
 *   // Subscribe
 *   eventBus.subscribe('hr.employee.*', async (event) => {
 *     console.log('Employee event:', event);
 *   });
 *
 *   await eventBus.startConsuming();
 */

import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { v4 as uuidv4 } from 'crypto';
import { ElementsEvent } from './schemas.js';

// Use crypto for UUID since we don't want to add another dependency
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type EventHandler = (event: ElementsEvent) => Promise<void>;

export class EventBus {
  private static readonly EXCHANGE_NAME = 'elements.events';

  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private handlers: Map<string, EventHandler[]> = new Map();
  private connected = false;

  constructor(
    private rabbitmqUrl: string,
    private moduleName: string
  ) {}

  /**
   * Connect to RabbitMQ and set up exchange/queue
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare topic exchange for events
      await this.channel.assertExchange(EventBus.EXCHANGE_NAME, 'topic', {
        durable: true,
      });

      // Declare queue for this module
      await this.channel.assertQueue(`elements.${this.moduleName}.events`, {
        durable: true,
      });

      this.connected = true;
      console.log(`[EventBus] Connected to RabbitMQ as module '${this.moduleName}'`);

      // Handle connection close
      this.connection.on('close', () => {
        this.connected = false;
        console.log('[EventBus] Connection closed');
      });

    } catch (error) {
      console.error('[EventBus] Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Disconnect from RabbitMQ
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connected = false;
      console.log('[EventBus] Disconnected from RabbitMQ');
    }
  }

  /**
   * Publish event to the bus
   */
  async publish(
    eventType: string,
    data: Record<string, unknown>,
    correlationId?: string
  ): Promise<string> {
    if (!this.connected) {
      await this.connect();
    }

    const event: ElementsEvent = {
      event_id: generateUuid(),
      event_type: eventType,
      source_module: this.moduleName,
      timestamp: new Date().toISOString(),
      correlation_id: correlationId || generateUuid(),
      data,
    };

    const message = JSON.stringify(event);

    this.channel!.publish(
      EventBus.EXCHANGE_NAME,
      eventType,
      Buffer.from(message),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.event_id,
        correlationId: event.correlation_id,
        timestamp: Date.now(),
      }
    );

    console.log(`[EventBus] Published event: ${eventType} (id=${event.event_id})`);
    return event.event_id;
  }

  /**
   * Subscribe to events matching pattern
   *
   * @param eventPattern Event pattern with wildcards (* for single word, # for multiple)
   * @param handler Async handler function
   */
  subscribe(eventPattern: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventPattern) || [];
    handlers.push(handler);
    this.handlers.set(eventPattern, handlers);
    console.log(`[EventBus] Subscribed handler to pattern: ${eventPattern}`);
  }

  /**
   * Start consuming events. This should be called after all subscriptions.
   */
  async startConsuming(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const queueName = `elements.${this.moduleName}.events`;

    // Bind queue to all patterns
    for (const pattern of this.handlers.keys()) {
      await this.channel!.bindQueue(queueName, EventBus.EXCHANGE_NAME, pattern);
      console.log(`[EventBus] Bound queue to pattern: ${pattern}`);
    }

    console.log(`[EventBus] Starting to consume events for module '${this.moduleName}'`);

    await this.channel!.consume(queueName, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const event: ElementsEvent = JSON.parse(msg.content.toString());
        console.log(`[EventBus] Received event: ${event.event_type}`);

        // Find matching handlers
        for (const [pattern, handlers] of this.handlers.entries()) {
          if (this.matchPattern(pattern, event.event_type)) {
            for (const handler of handlers) {
              try {
                await handler(event);
              } catch (error) {
                console.error(`[EventBus] Handler error for ${event.event_type}:`, error);
              }
            }
          }
        }

        this.channel!.ack(msg);
      } catch (error) {
        console.error('[EventBus] Failed to process message:', error);
        this.channel!.nack(msg, false, false); // Don't requeue
      }
    });
  }

  /**
   * Match event type against pattern
   */
  private matchPattern(pattern: string, eventType: string): boolean {
    const patternParts = pattern.split('.');
    const eventParts = eventType.split('.');

    // # matches everything after it
    if (pattern.includes('#')) {
      const prefixParts = pattern.split('#')[0].replace(/\.$/, '').split('.');
      if (prefixParts[0] === '') return true;

      for (let i = 0; i < prefixParts.length; i++) {
        if (prefixParts[i] !== eventParts[i]) return false;
      }
      return true;
    }

    if (patternParts.length !== eventParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '*') continue;
      if (patternParts[i] !== eventParts[i]) return false;
    }

    return true;
  }
}
