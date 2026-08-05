import {
  Controller,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  ALLOWED_IMAGE_MIME_REGEX,
  MAX_IMAGE_BYTES,
  UPLOAD_FOLDERS,
} from '../../common/media/image-upload.constraints';

@ApiTags('uploads')
@Controller('api/v1')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Generic admin image upload, for the CMS surfaces whose images are not
   * attached to a product: banner artwork and collection hero images.
   *
   * Product photos keep their own route (`admin/products/:id/media`) — that
   * one also creates a ProductMedia row and manages sortOrder, so it is not
   * the same operation with a different folder.
   */
  @ApiBearerAuth()
  @Post('admin/uploads/:folder')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'folder', enum: UPLOAD_FOLDERS })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: '[Admin/Staff] Upload a CMS image (jpeg/png/webp, max 8 MB)' })
  uploadImage(
    @Param('folder') folder: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: ALLOWED_IMAGE_MIME_REGEX })
        .addMaxSizeValidator({ maxSize: MAX_IMAGE_BYTES })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadsService.uploadImage(folder, file);
  }
}
