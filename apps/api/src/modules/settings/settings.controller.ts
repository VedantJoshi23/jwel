import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingView, SettingsService } from './settings.service';

/**
 * FEAT-SETTINGS-STORE §4 — admin only.
 *
 * There is deliberately no public endpoint. A storefront needing a setting gets
 * it through whichever endpoint already serves the surrounding data, rather
 * than through a general configuration endpoint that would invite reading
 * anything.
 */
@ApiTags('admin-settings')
@Controller('api/v1')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('admin/settings')
  @ApiOperation({ summary: 'List every declared setting with its effective value' })
  list(): Promise<SettingView[]> {
    return this.settings.list();
  }

  @Patch('admin/settings/:key')
  @ApiOperation({ summary: 'Set one declared setting' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SettingView> {
    return this.settings.set(key, dto.value, actor);
  }
}
