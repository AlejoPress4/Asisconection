import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../../config/env.validation';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { FaqKnowledge } from './entities/faq-knowledge.entity';
import {
  ASSISTANT_ENGINE_PROVIDER,
  type IAssistantEngineProvider,
} from './interfaces/i-assistant-engine.provider';
import { FAQ_KNOWLEDGE_REPOSITORY } from './interfaces/i-faq-knowledge.repository';
import { FaqRuleEngineProvider } from './providers/faq-rule-engine.provider';
import { RagMultimodalProviderStub } from './providers/rag-multimodal.provider.stub';
import { FaqKnowledgeRepository } from './repositories/faq-knowledge.repository';

@Module({
  imports: [TypeOrmModule.forFeature([FaqKnowledge])],
  controllers: [AssistantController],
  providers: [
    {
      provide: FAQ_KNOWLEDGE_REPOSITORY,
      useClass: FaqKnowledgeRepository,
    },
    FaqRuleEngineProvider,
    RagMultimodalProviderStub,
    {
      provide: ASSISTANT_ENGINE_PROVIDER,
      inject: [ConfigService, FaqRuleEngineProvider, RagMultimodalProviderStub],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        faqProvider: FaqRuleEngineProvider,
        ragStub: RagMultimodalProviderStub,
      ): IAssistantEngineProvider => {
        if (config.get('ASSISTANT_ENGINE', { infer: true }) === 'rag') {
          return ragStub;
        }
        return faqProvider;
      },
    },
    AssistantService,
  ],
  exports: [AssistantService, ASSISTANT_ENGINE_PROVIDER],
})
export class AssistantModule {}
