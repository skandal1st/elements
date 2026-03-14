import imaplib
import email
from email.header import decode_header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
from typing import List, Dict, Optional
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
                # FETCH (BODY.PEEK[]) instead of RFC822 to avoid setting \Seen unnecessarily
                status, data = self.mail.fetch(num, "(BODY.PEEK[] FLAGS)")
                if status != "OK":
                    continue
                    
                flags_data = data[0][0].decode()
                is_read = r"\Seen" in flags_data
                is_flagged = r"\Flagged" in flags_data

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                subject = self._decode_str(msg.get("Subject", ""))
                sender = self._decode_str(msg.get("From", ""))
                date = msg.get("Date", "")
                
                # Try to get plain text body for preview
                body_text = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        content_disposition = str(part.get("Content-Disposition"))
                        if content_type == "text/plain" and "attachment" not in content_disposition:
                            try:
                                body_text = part.get_payload(decode=True).decode(errors="ignore")
                                break
                            except:
                                pass
                else:
                    try:
                        body_text = msg.get_payload(decode=True).decode(errors="ignore")
                    except:
                        pass
                
                emails.append({
                    "subject": subject,
                    "sender": sender,
                    "date": date,
                    "preview": body_text[:200].replace("\r", " ").replace("\n", " ").strip() if body_text else "",
                    "is_read": is_read,
                    "is_flagged": is_flagged,
                    "has_attachments": msg.is_multipart(),
                    "folder": "INBOX"
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
                    except:
                        full_str += bytes_str.decode("utf-8", errors="ignore")
                else:
                    full_str += bytes_str.decode("utf-8", errors="ignore")
            else:
                full_str += str(bytes_str)
        return full_str

async def fetch_emails_async(host, port, login, password, ssl=True, limit=50):
    def _fetch():
        client = ImapClient(host, port, login, password, ssl)
        try:
            return client.fetch_inbox(limit)
        finally:
            client.close()
            
    return await asyncio.to_thread(_fetch)

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
