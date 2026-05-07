import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [MatchesModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
