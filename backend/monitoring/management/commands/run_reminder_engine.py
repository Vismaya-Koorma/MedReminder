import time
import signal
import sys
import logging
from datetime import datetime
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from monitoring.services import process_automatic_reminders

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Runs the automatic background medicine reminder processing loop.'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.running = True

    def handle(self, *args, **options):
        # Register signal handlers for graceful termination
        signal.signal(signal.SIGINT, self.handle_exit)
        signal.signal(signal.SIGTERM, self.handle_exit)

        interval = getattr(settings, 'REMINDER_CHECK_INTERVAL_SECONDS', 60)
        grace = getattr(settings, 'MISSED_DOSE_GRACE_MINUTES', 120)

        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(self.style.SUCCESS("AUTOMATIC MEDICINE REMINDER ENGINE RUNNER STARTED"))
        self.stdout.write(self.style.SUCCESS(f"Polling Interval: {interval} seconds"))
        self.stdout.write(self.style.SUCCESS(f"Missed Dose Grace Period: {grace} minutes"))
        self.stdout.write(self.style.SUCCESS(f"Timezone: {settings.TIME_ZONE} (USE_TZ={settings.USE_TZ})"))
        self.stdout.write(self.style.SUCCESS("Press Ctrl+C to stop the reminder engine process gracefully."))
        self.stdout.write(self.style.SUCCESS("=" * 65))

        while self.running:
            try:
                now_str = timezone.now().strftime('%Y-%m-%d %H:%M:%S %Z')
                self.stdout.write(f"\n[{now_str}] Executing reminder check cycle...")

                stats = process_automatic_reminders()

                self.stdout.write(
                    f"[{now_str}] Summary: {stats['logs_created']} new logs, "
                    f"{stats['due_count']} due, {stats['missed_count']} missed, "
                    f"{stats['reminder_notifications_sent']} reminder notifs, "
                    f"{stats['alert_notifications_sent']} alert notifs."
                )
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error during reminder processing cycle: {e}"))
                logger.exception("Error during reminder processing cycle")

            # Sleep in 1-second ticks to respond immediately to stop signals
            for _ in range(interval):
                if not self.running:
                    break
                time.sleep(1)

        self.stdout.write(self.style.WARNING("Reminder engine shutdown cleanly."))

    def handle_exit(self, signum, frame):
        self.stdout.write(self.style.WARNING("\nTermination signal received. Shutting down reminder engine..."))
        self.running = False
