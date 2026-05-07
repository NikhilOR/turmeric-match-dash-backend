import { forwardRef, Module } from '@nestjs/common';
import { GoogleSheetsModule } from '../google-sheets/google-sheets.module';
import { MatchesController } from './matches.controller';
import { MatchesGateway } from './matches.gateway';
import { MatchesService } from './matches.service';

@Module({
  imports: [forwardRef(() => GoogleSheetsModule)],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesGateway],
  exports: [MatchesService],
})
export class MatchesModule {}
