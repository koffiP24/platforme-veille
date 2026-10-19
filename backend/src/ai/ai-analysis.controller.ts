import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiAnalysisService } from './ai-analysis.service';
import { GenerateAiAnalysisDto } from './dto/generate-ai-analysis.dto';
import { ReviewAiAnalysisDto } from './dto/review-ai-analysis.dto';

interface AuthenticatedRequest extends Request { user: { id: number }; }

@Controller('api/v1/watch-items/:id/ai-analysis')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'RESPONSABLE_VEILLE', 'OPERATEUR_VEILLE')
export class AiAnalysisController {
  constructor(private readonly service: AiAnalysisService) {}
  @Get() getLatest(@Param('id', ParseIntPipe) id: number) { return this.service.getLatest(id); }
  @Post() analyze(@Param('id', ParseIntPipe) id: number, @Body() dto: GenerateAiAnalysisDto, @Req() req: AuthenticatedRequest) {
    return this.service.analyze(id, req.user.id, dto.force === true);
  }
  @Patch(':analysisId/review') review(@Param('id', ParseIntPipe) id: number, @Param('analysisId', ParseIntPipe) analysisId: number, @Body() dto: ReviewAiAnalysisDto, @Req() req: AuthenticatedRequest) {
    return this.service.review(id, analysisId, req.user.id, dto);
  }
}
