import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { FaqKnowledge } from './entities/faq-knowledge.entity';
import {
  ASSISTANT_ENGINE_PROVIDER,
  type IAssistantEngineProvider,
} from './interfaces/i-assistant-engine.provider';
import { FAQ_KNOWLEDGE_REPOSITORY } from './interfaces/i-faq-knowledge.repository';
import { FaqRuleEngineProvider } from './providers/faq-rule-engine.provider';
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
    {
      provide: ASSISTANT_ENGINE_PROVIDER,
      inject: [FaqRuleEngineProvider],
      useFactory: (faqProvider: FaqRuleEngineProvider): IAssistantEngineProvider => faqProvider,
    },
    AssistantService,
  ],
  exports: [AssistantService, ASSISTANT_ENGINE_PROVIDER],
})
export class AssistantModule {}
