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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth-guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateVariantDto } from './dto/create-variant.dto';
import { QueryVariantDto } from './dto/query-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { VariantResponseDto } from './dto/variant-response.dto';
import { VariantsService } from './variants.service';

@ApiTags('variants')
@Controller('variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Create a new variant' })
  @ApiBody({ type: CreateVariantDto })
  @ApiResponse({
    status: 201,
    description: 'Variant created successfully',
    type: VariantResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Variant already exists' })
  async create(@Body() createVariantDto: CreateVariantDto): Promise<VariantResponseDto> {
    return await this.variantsService.create(createVariantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get variants with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Variants fetched successfully' })
  async findAll(@Query() query: QueryVariantDto) {
    return await this.variantsService.findAll(query);
  }

  @Get('sku/:sku')
  @ApiOperation({ summary: 'Get variant by sku' })
  @ApiResponse({ status: 200, description: 'Variant fetched successfully' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  async findBySku(@Param('sku') sku: string): Promise<VariantResponseDto> {
    return await this.variantsService.findBySku(sku);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get variant by id' })
  @ApiResponse({ status: 200, description: 'Variant fetched successfully' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  async findOne(@Param('id') id: string): Promise<VariantResponseDto> {
    return await this.variantsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Update variant by id' })
  @ApiBody({ type: UpdateVariantDto })
  @ApiResponse({
    status: 200,
    description: 'Variant updated successfully',
    type: VariantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Variant or product not found' })
  @ApiResponse({ status: 409, description: 'Variant already exists' })
  async update(
    @Param('id') id: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ): Promise<VariantResponseDto> {
    return await this.variantsService.update(id, updateVariantDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-AUTH')
  @ApiOperation({ summary: 'Delete variant by id' })
  @ApiResponse({ status: 200, description: 'Variant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return await this.variantsService.remove(id);
  }
}
