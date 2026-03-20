import { Inject, Injectable } from "@nestjs/common";

import { PredchainAdminSdkClient } from "../client/predchain-admin-sdk.client";
import type { PredchainAdminSdkModuleOptions } from "../types";
import { PREDCHAIN_ADMIN_SDK_OPTIONS } from "./predchain-admin-sdk.constants";

@Injectable()
export class PredchainAdminSdkService extends PredchainAdminSdkClient {
  constructor(
    @Inject(PREDCHAIN_ADMIN_SDK_OPTIONS)
    options: PredchainAdminSdkModuleOptions,
  ) {
    super(options);
  }
}
