import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../social/entities/comment.entity';
import { Post } from '../social/entities/post.entity';
import { MODERATION_REPOSITORY } from './interfaces/i-moderation.repository';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ModerationRepository } from './repositories/moderation.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Comment])],
  controllers: [ModerationController],
  providers: [
    {
      provide: MODERATION_REPOSITORY,
      useClass: ModerationRepository,
    },
    ModerationService,
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
