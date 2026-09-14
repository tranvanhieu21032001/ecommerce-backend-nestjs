import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Tag } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateSlug } from 'src/common/utils/slug.util';
import { CreateTagDto } from './dto/create-tag.dto';
import { QueryTagDto } from './dto/query-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTagDto: CreateTagDto): Promise<TagResponseDto> {
    const { name, slug, ...rest } = createTagDto;
    const tagSlug = slug ?? generateSlug(name);

    const [existingName, existingSlug] = await Promise.all([
      this.prisma.tag.findUnique({ where: { name } }),
      this.prisma.tag.findUnique({ where: { slug: tagSlug } }),
    ]);

    if (existingName) {
      throw new ConflictException(`Tag with name ${name} already exists`);
    }

    if (existingSlug) {
      throw new ConflictException(`Tag with slug ${tagSlug} already exists`);
    }

    const tag = await this.prisma.tag.create({
      data: {
        name,
        slug: tagSlug,
        ...rest,
      },
      include: {
        _count: {
          select: {
            productTags: true,
          },
        },
      },
    });

    return this.formatTag(tag, Number(tag._count.productTags));
  }

  async findAll(queryDto: QueryTagDto): Promise<{
    data: TagResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { isActive, search, page = 1, limit = 10 } = queryDto;

    const where: Prisma.TagWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.tag.count({ where });

    const tags = await this.prisma.tag.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            productTags: true,
          },
        },
      },
    });

    return {
      data: tags.map((tag) => this.formatTag(tag, tag._count.productTags)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<TagResponseDto> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productTags: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.formatTag(tag, Number(tag._count.productTags));
  }

  async findBySlug(slug: string): Promise<TagResponseDto> {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            productTags: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.formatTag(tag, Number(tag._count.productTags));
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<TagResponseDto> {
    const existingTag = await this.prisma.tag.findUnique({
      where: { id },
    });

    if (!existingTag) {
      throw new NotFoundException('Tag not found');
    }

    if (updateTagDto.name && updateTagDto.name !== existingTag.name) {
      const nameTaken = await this.prisma.tag.findUnique({
        where: { name: updateTagDto.name },
      });

      if (nameTaken) {
        throw new ConflictException(`Tag with name ${updateTagDto.name} already exists`);
      }
    }

    if (updateTagDto.slug && updateTagDto.slug !== existingTag.slug) {
      const slugTaken = await this.prisma.tag.findUnique({
        where: { slug: updateTagDto.slug },
      });

      if (slugTaken) {
        throw new ConflictException(`Tag with slug ${updateTagDto.slug} already exists`);
      }
    }

    const updateData: Prisma.TagUncheckedUpdateInput = { ...updateTagDto };

    const updatedTag = await this.prisma.tag.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            productTags: true,
          },
        },
      },
    });

    return this.formatTag(updatedTag, Number(updatedTag._count.productTags));
  }

  async remove(id: string): Promise<{ message: string }> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.prisma.tag.delete({
      where: { id },
    });

    return { message: 'Tag deleted successfully' };
  }

  private formatTag(
    tag: Tag & { _count?: { productTags: number } },
    productCount: number,
  ): TagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      isActive: tag.isActive,
      productCount,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}
