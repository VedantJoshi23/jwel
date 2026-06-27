import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { PaginationQueryDto, PaginatedResult } from '../../common/dto/pagination-query.dto';
import { UserResponseDto } from './dto/user-response.dto';

// Never select passwordHash into a response payload — every read path below
// uses this explicit select so a future field addition to `users` can't
// accidentally leak into an API response the way a bare `findMany()` would.
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: SAFE_USER_SELECT });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { isDefault: 'desc' } });
  }

  async addAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({ data: { ...dto, userId } });
  }

  async removeAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('You cannot modify another user’s address');
    }
    await this.prisma.address.delete({ where: { id: addressId } });
  }

  async adminListUsers(query: PaginationQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    const { page, pageSize } = query;
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: SAFE_USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  async adminSuspendUser(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  }
}
