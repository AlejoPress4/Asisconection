import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { AssistantService } from './assistant.service';
import { EscalateRequestDto, EscalateResponseDto } from './dto/escalate.dto';
import { FaqQueryDto } from './dto/faq-query.dto';
import { FaqPageDto } from './dto/faq-response.dto';

@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('faqs')
  @ApiOperation({
    summary: 'Lista preguntas frecuentes (Fase 1) e incluye disclaimer obligatorio',
  })
  @ApiOkResponse({
    description: 'Respuestas FAQ y disclaimer informativo',
    type: FaqPageDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos',
    type: ProblemDetailsDto,
  })
  async getFaqs(@Query() query: FaqQueryDto): Promise<FaqPageDto> {
    return this.assistantService.getFaqs(query);
  }

  @Post('escalate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Genera enlace directo a WhatsApp para atención humana sin superposición',
  })
  @ApiBody({
    type: EscalateRequestDto,
    required: false,
  })
  @ApiOkResponse({
    description: 'URL limpia hacia WhatsApp oficial',
    type: EscalateResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de escalamiento inválidos',
    type: ProblemDetailsDto,
  })
  escalate(@Body() dto?: EscalateRequestDto): EscalateResponseDto {
    return this.assistantService.escalate(dto);
  }
}
