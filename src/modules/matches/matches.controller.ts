import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetMatchesQueryDto } from './dto/get-matches-query.dto';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOkResponse({ description: 'List all matches with filters and pagination' })
  findAll(@Query() query: GetMatchesQueryDto) {
    return this.matchesService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Get detailed match breakdown' })
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Post(':id/approve')
  @ApiOkResponse({ description: 'Approve best match, lock master row, and hide it in Google Sheets' })
  approve(@Param('id') id: string) {
    return this.matchesService.approveMatch(id);
  }
}
