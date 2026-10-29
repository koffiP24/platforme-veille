import { BadRequestException, Body, Controller, Param, ParseIntPipe, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WatchItemsService } from '../watch-items/watch-items.service';
import { DeepLService } from './deepl.service';

class TranslateMissingWatchItemsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}

@Controller('api/v1/watch-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WatchItemTranslationController {
  constructor(
    private readonly watchItemsService: WatchItemsService,
    private readonly deepLService: DeepLService,
  ) {}

  @Post('translate-missing')
  @Roles('ADMIN', 'RESPONSABLE_VEILLE', 'OPERATEUR_VEILLE')
  async translateMissing(@Body() dto: TranslateMissingWatchItemsDto) {
    const items = await this.watchItemsService.findItemsMissingFrenchTranslation(dto.limit ?? 10);
    let translated = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const result = await this.deepLService.translate({
          title: item.originalTitle ?? item.title,
          summary: item.originalSummary ?? item.summary,
          language: item.originalLanguage ?? item.language,
          originalTitle: item.originalTitle,
          originalSummary: item.originalSummary,
          originalLanguage: item.originalLanguage,
          frenchTitle: item.frenchTitle,
          frenchSummary: item.frenchSummary,
        });
        const needsTitle = !item.frenchTitle?.trim();
        const needsSummary = Boolean((item.originalSummary ?? item.summary)?.trim())
          && !item.frenchSummary?.trim();
        if ((needsTitle && !result.frenchTitle?.trim())
          || (needsSummary && !result.frenchSummary?.trim())) {
          failed++;
          continue;
        }
        await this.watchItemsService.saveFrenchTranslation(item.id, result);
        translated++;
      } catch {
        failed++;
      }
    }

    return {
      processed: items.length,
      translated,
      failed,
      remaining: await this.watchItemsService.countItemsMissingFrenchTranslation(),
    };
  }

  @Post(':id/translate-en')
  @Roles('ADMIN', 'RESPONSABLE_VEILLE', 'REFERENT_LABORATOIRE', 'OPERATEUR_VEILLE', 'LECTEUR')
  async translateFrenchItemToEnglish(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { roles: string[] } },
  ) {
    const item = await this.watchItemsService.findOneForRoles(id, request.user.roles ?? []);
    if (item.englishTitle) return item;

    const sourceLanguage = item.originalLanguage ?? item.language;
    if (!/^fr(?:-|$)/i.test(sourceLanguage ?? '')) {
      throw new BadRequestException('La traduction vers l’anglais est disponible pour les contenus français.');
    }

    try {
      const translation = await this.deepLService.translateFrenchToEnglish({
        title: item.originalTitle ?? item.frenchTitle ?? item.title,
        summary: item.originalSummary ?? item.frenchSummary ?? item.summary,
      });
      return this.watchItemsService.saveEnglishTranslation(id, translation);
    } catch {
      throw new ServiceUnavailableException('La traduction est temporairement indisponible. Vérifiez la configuration DeepL.');
    }
  }
}
