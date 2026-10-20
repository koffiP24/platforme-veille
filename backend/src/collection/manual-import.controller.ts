import {
  BadRequestException,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CollectionService } from './collection.service';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

interface UploadedImportFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('api/v1/sources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManualImportController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post(':id/import')
  @Roles('ADMIN', 'RESPONSABLE_VEILLE', 'OPERATEUR_VEILLE')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  }))
  importFile(
    @Param('id', ParseIntPipe) sourceId: number,
    @UploadedFile() file: UploadedImportFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Sélectionnez un fichier PDF, CSV ou XLSX.');
    return this.collectionService.importManual(sourceId, file, request.user.id);
  }
}
