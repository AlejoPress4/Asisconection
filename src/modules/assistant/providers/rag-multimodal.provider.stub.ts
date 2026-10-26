import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  AssistantFaqQuery,
  AssistantFaqResult,
  IAssistantEngineProvider,
} from '../interfaces/i-assistant-engine.provider';

/**
 * Punto de extensión Open/Closed (SOLID — OCP) para Fase 2:
 * Permite conmutar mediante `ASSISTANT_ENGINE=rag` en `AssistantModule` hacia
 * recuperación semántica con `pgvector` y síntesis controlada por LLM sin modificar
 * `AssistantController`, `AssistantService` ni los contratos HTTP consumidos por clientes.
 */
@Injectable()
export class RagMultimodalProviderStub implements IAssistantEngineProvider {
  resolveFaqs(_query: AssistantFaqQuery): Promise<AssistantFaqResult> {
    throw new NotImplementedException('Motor RAG multimodal disponible en Fase 2');
  }
}
