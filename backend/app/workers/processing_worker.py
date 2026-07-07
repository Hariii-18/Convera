"""Background task entry point.

Registered with FastAPI `BackgroundTasks`; kept separate from
`processing_service` so the dequeue/invocation mechanism (currently
`BackgroundTasks`, potentially a real queue later) can change without
touching the per-job execution logic.
"""

import logging
import uuid

from app.services.processing_service import execute_processing_job

logger = logging.getLogger("converra")


async def run_processing_job(job_id: uuid.UUID) -> None:
    logger.info("Starting processing job %s", job_id)
    await execute_processing_job(job_id)
    logger.info("Finished processing job %s", job_id)
