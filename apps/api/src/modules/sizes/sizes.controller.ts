import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QuerySizesDto } from './dto/query-sizes.dto';
import { SizeOptionResponse, SizesService } from './sizes.service';

@ApiTags('sizes')
@Controller('api/v1')
export class SizesController {
  constructor(private readonly sizes: SizesService) {}

  /**
   * Public: the storefront size filter and the PDP size guide both read this,
   * and neither is behind auth.
   */
  @Public()
  @Get('sizes')
  @ApiOperation({ summary: 'List seeded size options, optionally for one scheme' })
  findAll(@Query() query: QuerySizesDto): Promise<SizeOptionResponse[]> {
    return this.sizes.findAll(query.scheme, query.curatedOnly ?? false);
  }
}
