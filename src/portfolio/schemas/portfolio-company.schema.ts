import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type PortfolioCompanyDocument = HydratedDocument<PortfolioCompany>;

@Schema({ timestamps: true })
export class PortfolioCompany {
  @ApiProperty({ example: '1-800 Contacts', description: 'Name of the company' })
  @Prop({ required: true, unique: true, index: true })
  name!: string;

  @ApiProperty({ example: 'Growth Equity', description: 'Asset class of the company' })
  @Prop({ required: true })
  assetClass!: string;

  @ApiProperty({
    example: 'Consumer',
    description: 'Industry sector',
    required: false,
  })
  @Prop()
  industry?: string;

  @ApiProperty({
    example: 'Americas',
    description: 'Geographic region',
    required: false,
  })
  @Prop()
  region?: string;

  @ApiProperty({
    example: { website: 'https://www.1800contacts.com' },
    description: 'Additional data',
    required: false,
  })
  @Prop({ type: Object })
  extraData?: Record<string, unknown>;
}

export const PortfolioCompanySchema = SchemaFactory.createForClass(PortfolioCompany);
