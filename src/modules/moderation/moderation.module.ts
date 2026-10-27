import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../social/entities/comment.entity';
import { Post } from '../social/entities/post.entity';
import { ContentFilterService } from './content-filter.service';
import {
  CONTENT_FILTER_RULES,
  type IContentRule,
} from './interfaces/i-content-rule.interface';
import { MODERATION_REPOSITORY } from './interfaces/i-moderation.repository';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ModerationRepository } from './repositories/moderation.repository';
import { ExternalLinkContentRule } from './rules/external-link.rule';
import { MinorDataContentRule } from './rules/minor-data.rule';
import { ProfanityContentRule } from './rules/profanity.rule';
import { SpamContentRule } from './rules/spam.rule';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Comment])],
  controllers: [ModerationController],
  providers: [
    {
      provide: MODERATION_REPOSITORY,
      useClass: ModerationRepository,
    },
    ProfanityContentRule,
    ExternalLinkContentRule,
    MinorDataContentRule,
    SpamContentRule,
    {
      provide: CONTENT_FILTER_RULES,
      inject: [
        ProfanityContentRule,
        ExternalLinkContentRule,
        MinorDataContentRule,
        SpamContentRule,
      ],
      useFactory: (
        profanity: ProfanityContentRule,
        externalLink: ExternalLinkContentRule,
        minorData: MinorDataContentRule,
        spam: SpamContentRule,
      ): ReadonlyArray<IContentRule> => [profanity, externalLink, minorData, spam],
    },
    ContentFilterService,
    ModerationService,
  ],
  exports: [ModerationService, ContentFilterService, CONTENT_FILTER_RULES],
})
export class ModerationModule {}
