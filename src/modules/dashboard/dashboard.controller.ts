import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetMatchesQueryDto } from '../matches/dto/get-matches-query.dto';
import { MatchesService } from '../matches/matches.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('summary')
  @ApiOkResponse({ description: 'Get dashboard summary stats' })
  getSummary(@Query() query: GetMatchesQueryDto) {
    return this.matchesService.getSummary(query);
  }
}
