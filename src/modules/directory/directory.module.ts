import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';
import { RedirectionLink } from './entities/redirection-link.entity';
import { REDIRECTION_LINK_REPOSITORY } from './interfaces/i-redirection-link.repository';
import { RedirectionLinkRepository } from './repositories/redirection-link.repository';

@Module({
  imports: [TypeOrmModule.forFeature([RedirectionLink])],
  controllers: [DirectoryController],
  providers: [
    {
      provide: REDIRECTION_LINK_REPOSITORY,
      useClass: RedirectionLinkRepository,
    },
    DirectoryService,
  ],
  exports: [DirectoryService],
})
export class DirectoryModule {}
