import { Module } from '@nestjs/common';
import { BuyersService } from './buyers.service';

@Module({
  providers: [BuyersService],
  exports: [BuyersService],
})
export class BuyersModule {}
