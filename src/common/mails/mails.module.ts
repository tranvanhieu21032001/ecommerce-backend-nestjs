import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { existsSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { MailsService } from './mails.service';
import { MailsController } from './mails.controller';
@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const port = Number(config.get('MAIL_PORT') || 587);
        const templateCandidates = [
          join(process.cwd(), 'src', 'common', 'mails', 'templates'),
          join(process.cwd(), 'dist', 'common', 'mails', 'templates'),
          join(__dirname, 'templates'),
        ];
        const templateDir =
          templateCandidates.find((dir) => existsSync(join(dir, 'confirmation.hbs'))) ??
          join(process.cwd(), 'src', 'common', 'mails', 'templates');

        return {
          transport: {
            host: config.get('MAIL_HOST'),
            port,
            secure: port === 465,
            auth: {
              user: config.get('MAIL_USER'),
              pass: config.get('MAIL_PASSWORD'),
            },
          },
          defaults: {
            from: `"No Reply" <${config.get('MAIL_FROM') || config.get('MAIL_USER')}>`,
          },
          template: {
            dir: templateDir,
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailsService],
  controllers: [MailsController],
  exports: [MailsService],
})
export class MailsModule {}
