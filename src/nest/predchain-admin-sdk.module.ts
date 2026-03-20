import { DynamicModule, Module } from "@nestjs/common";

import type { PredchainAdminSdkModuleOptions } from "../types";
import { PREDCHAIN_ADMIN_SDK_OPTIONS } from "./predchain-admin-sdk.constants";
import { PredchainAdminSdkService } from "./predchain-admin-sdk.service";

@Module({})
export class PredchainAdminSdkModule {
  static forRoot(options: PredchainAdminSdkModuleOptions): DynamicModule {
    return {
      module: PredchainAdminSdkModule,
      providers: [
        { provide: PREDCHAIN_ADMIN_SDK_OPTIONS, useValue: options },
        PredchainAdminSdkService,
      ],
      exports: [PredchainAdminSdkService],
      global: false,
    };
  }
}
