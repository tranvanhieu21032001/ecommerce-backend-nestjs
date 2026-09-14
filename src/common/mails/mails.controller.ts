import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { MailsService } from './mails.service';

class SendTestMailDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

@Controller('mails')
export class MailsController {
  constructor(private readonly mailsService: MailsService) {}

  @Post('test')
  async sendTestMail(@Body() body: SendTestMailDto) {
    await this.mailsService.sendConfirmationEmail(body.email, body.name, 'test-token');
    return { message: 'Test email sent' };
  }
}
