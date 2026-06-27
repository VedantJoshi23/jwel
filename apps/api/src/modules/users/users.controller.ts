import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('api/v1')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user’s profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user’s profile' })
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get('me/addresses')
  @ApiOperation({ summary: 'List the current user’s saved addresses' })
  listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listAddresses(user.userId);
  }

  @Post('me/addresses')
  @ApiOperation({ summary: 'Add a saved address for the current user' })
  addAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.usersService.addAddress(user.userId, dto);
  }

  @Delete('me/addresses/:addressId')
  @ApiOperation({ summary: 'Remove one of the current user’s saved addresses' })
  removeAddress(@CurrentUser() user: AuthenticatedUser, @Param('addressId') addressId: string) {
    return this.usersService.removeAddress(user.userId, addressId);
  }

  @Get('admin/users')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: '[Admin/Staff] List customer accounts' })
  adminListUsers(@Query() query: PaginationQueryDto) {
    return this.usersService.adminListUsers(query);
  }

  @Patch('admin/users/:userId/suspend')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Suspend a user account (soft delete)' })
  adminSuspendUser(@Param('userId') userId: string) {
    return this.usersService.adminSuspendUser(userId);
  }
}
