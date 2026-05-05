import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

@Injectable()
export class MailsService {
  private readonly logger = new Logger(MailsService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendConfirmationEmail(email: string, name: string, token: string): Promise<void> {
    const url = `http://localhost:8800/api/v1/auth/confirm?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Confirm your email',
        template: './confirmation',
        context: {
          name,
          url,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown mail error';
      this.logger.error(
        `Send mail failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(`Send mail failed: ${message}`);
    }
  }
}
