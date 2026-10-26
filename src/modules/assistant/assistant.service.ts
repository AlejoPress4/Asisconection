import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildPaginationMeta } from '../../common/dto/pagination.util';
import type { EnvironmentVariables } from '../../config/env.validation';
import { WHATSAPP_SUPPORT_NOTICE } from './assistant.constants';
import type { EscalateRequestDto, EscalateResponseDto } from './dto/escalate.dto';
import type { FaqQueryDto } from './dto/faq-query.dto';
import type { FaqPageDto } from './dto/faq-response.dto';
import {
  ASSISTANT_ENGINE_PROVIDER,
  type IAssistantEngineProvider,
} from './interfaces/i-assistant-engine.provider';

@Injectable()
export class AssistantService {
  constructor(
    @Inject(ASSISTANT_ENGINE_PROVIDER)
    private readonly assistantEngine: IAssistantEngineProvider,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async getFaqs(query: FaqQueryDto): Promise<FaqPageDto> {
    const result = await this.assistantEngine.resolveFaqs({
      category: query.category,
      page: query.page,
      limit: query.limit,
    });

    return {
      disclaimer: result.disclaimer,
      data: result.items.map((item) => ({
        id: item.id,
        question: item.question,
        answer: item.answer,
        category: item.category,
      })),
      meta: buildPaginationMeta(query.page, query.limit, result.totalItems),
    };
  }

  escalate(dto?: EscalateRequestDto): EscalateResponseDto {
    const phone = this.configService.get('WHATSAPP_SUPPORT_PHONE', { infer: true });
    const baseMessage = this.configService.get('WHATSAPP_DEFAULT_MESSAGE', { infer: true });
    const trimmedTopic = dto?.topic?.trim();
    const composedMessage = trimmedTopic ? `${baseMessage} Tema: ${trimmedTopic}` : baseMessage;

    return {
      whatsapp_url: `https://wa.me/${phone}?text=${encodeURIComponent(composedMessage)}`,
      support_message: WHATSAPP_SUPPORT_NOTICE,
    };
  }
}
