import imaplib
import email
import re
from email.header import decode_header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
from typing import List, Dict, Optional, Tuple
import json
import logging
import aiosmtplib

logger = logging.getLogger(__name__)

class ImapClient:
    def __init__(self, host: str, port: int, login: str, password: str, ssl: bool = True):
        self.host = host
        self.port = port
        self.login_user = login
        self.password = password
        self.ssl = ssl
        self.mail = None

    def connect(self):
        try:
            if self.ssl:
                self.mail = imaplib.IMAP4_SSL(self.host, port=self.port, timeout=10)
            else:
                self.mail = imaplib.IMAP4(self.host, port=self.port, timeout=10)
            self.mail.login(self.login_user, self.password)
            return True
        except Exception as e:
            logger.error(f"IMAP login failed: {e}")
            return False

    def close(self):
        if self.mail:
            try:
                self.mail.logout()
            except:
                pass

    def fetch_inbox(self, limit: int = 50) -> List[Dict]:
        if not self.mail:
            if not self.connect():
                return []
        
        try:
            self.mail.select("INBOX", readonly=True)
            status, messages_data = self.mail.search(None, "ALL")
            if status != "OK":
                return []
                
            msg_nums = messages_data[0].split()
            msg_nums = msg_nums[-limit:]  # Get latest `limit` emails
            msg_nums.reverse()
            
            emails = []
            for num in msg_nums:
                # FETCH UID + FLAGS + BODY.PEEK[] to get stable UID and avoid setting \Seen
                status, data = self.mail.fetch(num, "(UID FLAGS BODY.PEEK[])")
                if status != "OK" or not data or not data[0]:
                    continue
                part0 = data[0][0].decode() if isinstance(data[0][0], bytes) else str(data[0][0])
                uid_match = re.search(r"UID\s+(\d+)", part0, re.IGNORECASE)
                uid = int(uid_match.group(1)) if uid_match else int(num)
                is_read = r"\Seen" in part0
                is_flagged = r"\Flagged" in part0

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)
                subject = self._decode_str(msg.get("Subject", ""))
                sender = self._decode_str(msg.get("From", ""))
                date = msg.get("Date", "")

                body_text, _ = self._get_text_and_html_body(msg)
                preview = body_text[:200].replace("\r", " ").replace("\n", " ").strip() if body_text else ""

                has_attachments = msg.is_multipart() and any(
                    part.get_content_disposition() == "attachment"
                    for part in msg.walk()
                )

                emails.append({
                    "uid": uid,
                    "subject": subject,
                    "sender": sender,
                    "date": date,
                    "preview": preview,
                    "is_read": is_read,
                    "is_flagged": is_flagged,
                    "has_attachments": has_attachments,
                    "folder": "INBOX",
                })
            return emails
        except Exception as e:
            logger.error(f"IMAP fetch failed: {e}")
            return []

    def _decode_str(self, s: str) -> str:
        if not s:
            return ""
        decoded_parts = decode_header(s)
        full_str = ""
        for bytes_str, charset in decoded_parts:
            if isinstance(bytes_str, bytes):
                if charset:
                    try:
                        full_str += bytes_str.decode(charset)
                    except Exception:
                        full_str += bytes_str.decode("utf-8", errors="ignore")
                else:
                    full_str += bytes_str.decode("utf-8", errors="ignore")
            else:
                full_str += str(bytes_str)
        return full_str

    def _get_text_and_html_body(self, msg) -> Tuple[str, str]:
        """Extract plain text and HTML body from message. Returns (text_body, html_body)."""
        text_body = ""
        html_body = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_disposition = str(part.get("Content-Disposition", ""))
                if "attachment" in content_disposition:
                    continue
                content_type = part.get_content_type()
                try:
                    payload = part.get_payload(decode=True)
                    if not payload:
                        continue
                    charset = part.get_content_charset() or "utf-8"
                    decoded = payload.decode(charset, errors="replace")
                    if content_type == "text/plain":
                        text_body = decoded
                    elif content_type == "text/html":
                        html_body = decoded
                except Exception:
                    continue
        else:
            try:
                payload = msg.get_payload(decode=True)
                if payload:
                    charset = msg.get_content_charset() or "utf-8"
                    decoded = payload.decode(charset, errors="replace")
                    if msg.get_content_type() == "text/html":
                        html_body = decoded
                        text_body = decoded  # fallback for preview
                    else:
                        text_body = decoded
            except Exception:
                pass
        return (text_body or "", html_body or "")

    def fetch_message_by_uid(self, uid: int) -> Optional[Dict]:
        """Fetch a single message by IMAP UID and return full body (text + html)."""
        if not self.mail and not self.connect():
            return None
        try:
            self.mail.select("INBOX", readonly=True)
            status, data = self.mail.uid("FETCH", str(uid), "(BODY.PEEK[])")
            if status != "OK" or not data or not data[0]:
                return None
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)
            subject = self._decode_str(msg.get("Subject", ""))
            sender = self._decode_str(msg.get("From", ""))
            date = msg.get("Date", "")
            text_body, html_body = self._get_text_and_html_body(msg)
            return {
                "uid": uid,
                "subject": subject,
                "sender": sender,
                "date": date,
                "text_body": text_body,
                "html_body": html_body,
            }
        except Exception as e:
            logger.error("fetch_message_by_uid failed: %s", e)
            return None

    def set_seen_by_uid(self, uid: int) -> bool:
        """Set \\Seen flag for the message with given UID."""
        if not self.mail and not self.connect():
            return False
        try:
            self.mail.select("INBOX", readonly=False)
            status, _ = self.mail.uid("STORE", str(uid), "+FLAGS", "\\Seen")
            return status == "OK"
        except Exception as e:
            logger.error("set_seen_by_uid failed: %s", e)
            return False


async def fetch_emails_async(host, port, login, password, ssl=True, limit=50):
    def _fetch():
        client = ImapClient(host, port, login, password, ssl)
        try:
            return client.fetch_inbox(limit)
        finally:
            client.close()

    return await asyncio.to_thread(_fetch)


async def fetch_message_by_uid_async(host, port, login, password, ssl, uid: int):
    def _fetch():
        client = ImapClient(host, port, login, password, ssl)
        try:
            return client.fetch_message_by_uid(uid)
        finally:
            client.close()

    return await asyncio.to_thread(_fetch)


async def set_seen_by_uid_async(host, port, login, password, ssl, uid: int):
    def _store():
        client = ImapClient(host, port, login, password, ssl)
        try:
            return client.set_seen_by_uid(uid)
        finally:
            client.close()

    return await asyncio.to_thread(_store)

async def send_email_async(host, port, login, password, ssl, to_email, subject, text_body, html_body=None):
    message = MIMEMultipart("alternative")
    message["From"] = login
    message["To"] = to_email
    message["Subject"] = subject

    part1 = MIMEText(text_body, "plain", "utf-8")
    message.attach(part1)

    if html_body:
        part2 = MIMEText(html_body, "html", "utf-8")
        message.attach(part2)

    await aiosmtplib.send(
        message,
        hostname=host,
        port=port,
        username=login,
        password=password,
        use_tls=ssl
    )
    return True
