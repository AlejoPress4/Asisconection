import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProblemDetailsDto } from '../../common/filters/all-exceptions.filter';
import { DeviceSessionGuard } from '../../common/guards/device-session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssistantService } from './assistant.service';
import { EscalateRequestDto, EscalateResponseDto } from './dto/escalate.dto';
import { FaqQueryDto } from './dto/faq-query.dto';
import {
  CreateFaqDto,
  DeletedFaqResponseDto,
  FaqItemDto,
  FaqPageDto,
  UpdateFaqDto,
} from './dto/faq-response.dto';

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

@ApiTags('Admin - Assistant FAQs')
@ApiBearerAuth('DeviceSessionBearer')
@Controller('admin/faqs')
@UseGuards(DeviceSessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminFaqsController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea una nueva pregunta frecuente en la base de conocimiento (Solo ADMIN)',
  })
  @ApiCreatedResponse({
    description: 'Pregunta frecuente creada',
    type: FaqItemDto,
  })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  async createFaq(@Body() dto: CreateFaqDto): Promise<FaqItemDto> {
    return this.assistantService.createFaq(dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualiza una pregunta frecuente existente (Solo ADMIN)',
  })
  @ApiOkResponse({
    description: 'Pregunta frecuente actualizada',
    type: FaqItemDto,
  })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async updateFaq(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqDto,
  ): Promise<FaqItemDto> {
    return this.assistantService.updateFaq(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina una pregunta frecuente de la base de conocimiento (Solo ADMIN)',
  })
  @ApiOkResponse({
    description: 'Pregunta frecuente eliminada',
    type: DeletedFaqResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  async deleteFaq(@Param('id', ParseUUIDPipe) id: string): Promise<DeletedFaqResponseDto> {
    return this.assistantService.deleteFaq(id);
  }
}
