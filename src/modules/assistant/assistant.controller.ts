import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { EscalateRequestDto, EscalateResponseDto } from './dto/escalate.dto';
import { FaqQueryDto } from './dto/faq-query.dto';
import { FaqPageDto } from './dto/faq-response.dto';

@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  /** Lista preguntas frecuentes (Fase 1) e incluye disclaimer obligatorio */
  @Get('faqs')
  async getFaqs(@Query() query: FaqQueryDto): Promise<FaqPageDto> {
    return this.assistantService.getFaqs(query);
  }

  /** Genera enlace directo a WhatsApp para atención humana sin superposición */
  @Post('escalate')
  @HttpCode(HttpStatus.OK)
  escalate(@Body() dto?: EscalateRequestDto): EscalateResponseDto {
    return this.assistantService.escalate(dto);
  }
}
