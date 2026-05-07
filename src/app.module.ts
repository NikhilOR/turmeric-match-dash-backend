import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BuyersModule } from './modules/buyers/buyers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import appConfig from './config/app.config';
import { validateEnv } from './config/env.validation';
import { ExportersModule } from './modules/exporters/exporters.module';
import { GoogleSheetsModule } from './modules/google-sheets/google-sheets.module';
import { MatchesModule } from './modules/matches/matches.module';
import { MatchingEngineModule } from './modules/matching-engine/matching-engine.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SuppliersModule,
    BuyersModule,
    ExportersModule,
    MatchingEngineModule,
    MatchesModule,
    DashboardModule,
    GoogleSheetsModule,
  ],
})
export class AppModule {}
