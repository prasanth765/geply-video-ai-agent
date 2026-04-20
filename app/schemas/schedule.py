from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SlotCreateRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"


class BulkSlotCreateRequest(BaseModel):
    job_id: str
    slots: list[SlotCreateRequest]


class SlotBookRequest(BaseModel):
    slot_id: str
    candidate_token: str


class SelfScheduleRequest(BaseModel):
    candidate_token: str
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"


class SlotResponse(BaseModel):
    id: str
    job_id: str
    start_time: datetime
    end_time: datetime
    timezone: str
    is_booked: bool
    is_available: bool
    candidate_id: str | None = None

    model_config = {"from_attributes": True}


class ExistingBooking(BaseModel):
    slot_id: str
    start_time: datetime
    end_time: datetime
    timezone: str


class AvailableSlotsResponse(BaseModel):
    job_title: str
    job_description: str
    company: str
    candidate_name: str = ""
    candidate_status: str = ""
    already_interviewed: bool = False
    existing_booking: ExistingBooking | None = None
    slots: list[SlotResponse]
