from __future__ import annotations

from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)

# Sentinel to distinguish "not provided" from "explicitly set to None"
_UNSET = object()


class BaseRepository(Generic[ModelT]):
    """Generic async CRUD repository.

    Every model-specific repo inherits from this and gets
    create/get/list/update/delete for free. Custom queries
    go in the child class.
    """

    def __init__(self, model: type[ModelT], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def create(self, **kwargs: Any) -> ModelT:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def get_by_id(self, entity_id: str) -> ModelT | None:
        return await self.session.get(self.model, entity_id)

    async def get_one(self, **filters: Any) -> ModelT | None:
        stmt = select(self.model).filter_by(**filters)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_many(
        self,
        offset: int = 0,
        limit: int = 50,
        order_by: str = "created_at",
        descending: bool = True,
        **filters: Any,
    ) -> tuple[Sequence[ModelT], int]:
        base = select(self.model).filter_by(**filters)
        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()

        col = getattr(self.model, order_by, self.model.created_at)
        ordered = base.order_by(col.desc() if descending else col.asc())
        stmt = ordered.offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all(), total

    async def update(self, entity_id: str, **kwargs: Any) -> ModelT | None:
        """Update an entity by ID.

        Only keys present in kwargs are updated. A value of None will be
        written to the DB (use this to clear fields). To skip a field,
        simply don't include it in kwargs.
        """
        instance = await self.get_by_id(entity_id)
        if not instance:
            return None
        for key, value in kwargs.items():
            if hasattr(instance, key):
                setattr(instance, key, value)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, entity_id: str) -> bool:
        instance = await self.get_by_id(entity_id)
        if not instance:
            return False
        await self.session.delete(instance)
        await self.session.flush()
        return True

    async def bulk_create(self, items: list[dict[str, Any]]) -> list[ModelT]:
        instances = [self.model(**item) for item in items]
        self.session.add_all(instances)
        await self.session.flush()
        for inst in instances:
            await self.session.refresh(inst)
        return instances

    async def execute_query(self, stmt: Select) -> Sequence[ModelT]:
        result = await self.session.execute(stmt)
        return result.scalars().all()
