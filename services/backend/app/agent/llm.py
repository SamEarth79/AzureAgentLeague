"""LLM configuration for the ArchMind agent.

Currently exposes a `MockLLM` that returns deterministic, no-op responses.
Replace with `AzureChatOpenAI` from `langchain_openai` when real LLM calls
are needed.
"""
from __future__ import annotations

from typing import Any, List, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult


class MockLLM(BaseChatModel):
    """A drop-in chat model that returns a fixed AIMessage.

    Useful for tests and demos that need an LLM-typed object but should not
    hit any real API. The response is parameterised on the last user message
    so it's deterministic per input.
    """

    model_name: str = "mock-llm"

    @property
    def _llm_type(self) -> str:
        return "mock"

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        last_user = next(
            (m for m in reversed(messages) if m.type == "human"),
            None,
        )
        snippet = ""
        if last_user is not None:
            content = last_user.content
            if isinstance(content, str):
                snippet = content[:80]
        response = AIMessage(
            content=f"[MockLLM] Acknowledged: {snippet or '(no input)'}",
        )
        return ChatResult(generations=[ChatGeneration(message=response)])

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResult:
        return self._generate(messages, stop=stop, run_manager=run_manager, **kwargs)


def get_llm() -> BaseChatModel:
    return MockLLM()
