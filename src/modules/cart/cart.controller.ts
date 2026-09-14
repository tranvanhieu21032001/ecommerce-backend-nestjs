import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@Controller('cart')
@ApiBearerAuth('JWT-AUTH')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated customer open cart' })
  findOpenCart(@GetUser('id') userId: string) {
    return this.cartService.findOpenCart(userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a product to the authenticated customer cart' })
  addItem(@GetUser('id') userId: string, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(userId, dto);
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Update a product quantity in the open cart' })
  updateItem(
    @GetUser('id') userId: string,
    @Param('productId') productId: string,
    @Query('variationId') variationId: string | undefined,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(userId, productId, variationId, dto);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove a product from the open cart' })
  removeItem(
    @GetUser('id') userId: string,
    @Param('productId') productId: string,
    @Query('variationId') variationId: string | undefined,
  ) {
    return this.cartService.removeItem(userId, productId, variationId);
  }

  @Delete('items')
  @ApiOperation({ summary: 'Clear the authenticated customer open cart' })
  clear(@GetUser('id') userId: string) {
    return this.cartService.clear(userId);
  }
}
