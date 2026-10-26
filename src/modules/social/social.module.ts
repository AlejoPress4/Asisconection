import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from './controllers/categories.controller';
import { PostsController } from './controllers/posts.controller';
import { Category } from './entities/category.entity';
import { Comment } from './entities/comment.entity';
import { Post } from './entities/post.entity';
import { Reaction } from './entities/reaction.entity';
import { CATEGORY_REPOSITORY } from './interfaces/i-category.repository';
import { COMMENT_REPOSITORY } from './interfaces/i-comment.repository';
import { POST_REPOSITORY } from './interfaces/i-post.repository';
import { REACTION_REPOSITORY } from './interfaces/i-reaction.repository';
import { CategoryRepository } from './repositories/category.repository';
import { CommentRepository } from './repositories/comment.repository';
import { PostRepository } from './repositories/post.repository';
import { ReactionRepository } from './repositories/reaction.repository';
import { CategoriesService } from './services/categories.service';
import { PostsService } from './services/posts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Post, Comment, Reaction])],
  controllers: [CategoriesController, PostsController],
  providers: [
    {
      provide: CATEGORY_REPOSITORY,
      useClass: CategoryRepository,
    },
    {
      provide: POST_REPOSITORY,
      useClass: PostRepository,
    },
    {
      provide: COMMENT_REPOSITORY,
      useClass: CommentRepository,
    },
    {
      provide: REACTION_REPOSITORY,
      useClass: ReactionRepository,
    },
    CategoriesService,
    PostsService,
  ],
  exports: [TypeOrmModule, CategoriesService, PostsService],
})
export class SocialModule {}
