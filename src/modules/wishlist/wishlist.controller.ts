import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@Controller('wishlist')
@ApiBearerAuth('JWT-AUTH')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get products saved by the authenticated customer' })
  findAll(@GetUser('id') userId: string) {
    return this.wishlistService.findAll(userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Save a product to the authenticated customer wishlist' })
  addItem(@GetUser('id') userId: string, @Body() dto: AddWishlistItemDto) {
    return this.wishlistService.addItem(userId, dto);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove a product from the authenticated customer wishlist' })
  removeItem(@GetUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlistService.removeItem(userId, productId);
  }

  @Delete('items')
  @ApiOperation({ summary: 'Clear the authenticated customer wishlist' })
  clear(@GetUser('id') userId: string) {
    return this.wishlistService.clear(userId);
  }
}
