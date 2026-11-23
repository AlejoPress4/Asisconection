import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildPaginationMeta } from '../../common/dto/pagination.util';
import type { EnvironmentVariables } from '../../config/env.validation';
import { WHATSAPP_SUPPORT_NOTICE } from './assistant.constants';
import type { EscalateRequestDto, EscalateResponseDto } from './dto/escalate.dto';
import type { FaqQueryDto } from './dto/faq-query.dto';
import type {
  CreateFaqDto,
  DeletedFaqResponseDto,
  FaqItemDto,
  FaqPageDto,
  UpdateFaqDto,
} from './dto/faq-response.dto';
import {
  ASSISTANT_ENGINE_PROVIDER,
  type IAssistantEngineProvider,
} from './interfaces/i-assistant-engine.provider';
import {
  FAQ_KNOWLEDGE_REPOSITORY,
  type IFaqKnowledgeRepository,
} from './interfaces/i-faq-knowledge.repository';

@Injectable()
export class AssistantService {
  constructor(
    @Inject(ASSISTANT_ENGINE_PROVIDER)
    private readonly assistantEngine: IAssistantEngineProvider,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    @Optional()
    @Inject(FAQ_KNOWLEDGE_REPOSITORY)
    private readonly faqRepository?: IFaqKnowledgeRepository,
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

  async createFaq(dto: CreateFaqDto): Promise<FaqItemDto> {
    if (!this.faqRepository?.create) {
      throw new NotFoundException('El repositorio de FAQs no soporta creación.');
    }

    const created = await this.faqRepository.create({
      question: dto.question,
      answer: dto.answer,
      category: dto.category,
    });

    return {
      id: created.id,
      question: created.question,
      answer: created.answer,
      category: created.category,
    };
  }

  async updateFaq(id: string, dto: UpdateFaqDto): Promise<FaqItemDto> {
    if (
      dto.question === undefined &&
      dto.answer === undefined &&
      dto.category === undefined
    ) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo (question, answer o category) para actualizar la FAQ.',
      );
    }

    if (!this.faqRepository?.update) {
      throw new NotFoundException('El repositorio de FAQs no soporta actualización.');
    }

    const updated = await this.faqRepository.update(id, {
      question: dto.question,
      answer: dto.answer,
      category: dto.category,
    });

    if (!updated) {
      throw new NotFoundException(`No existe una pregunta frecuente con id "${id}".`);
    }

    return {
      id: updated.id,
      question: updated.question,
      answer: updated.answer,
      category: updated.category,
    };
  }

  async deleteFaq(id: string): Promise<DeletedFaqResponseDto> {
    if (!this.faqRepository?.deleteById) {
      throw new NotFoundException('El repositorio de FAQs no soporta eliminación.');
    }

    const deleted = await this.faqRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException(`No existe una pregunta frecuente con id "${id}".`);
    }

    return {
      id,
      deleted: true,
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
