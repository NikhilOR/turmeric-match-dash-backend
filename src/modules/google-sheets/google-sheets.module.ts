import { forwardRef, Module } from '@nestjs/common';
import { BuyersModule } from '../buyers/buyers.module';
import { ExportersModule } from '../exporters/exporters.module';
import { MatchesModule } from '../matches/matches.module';
import { MatchingEngineModule } from '../matching-engine/matching-engine.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSheetsSyncService } from './google-sheets-sync.service';

@Module({
  imports: [
    SuppliersModule,
    BuyersModule,
    ExportersModule,
    MatchingEngineModule,
    forwardRef(() => MatchesModule),
  ],
  providers: [GoogleSheetsService, GoogleSheetsSyncService],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
