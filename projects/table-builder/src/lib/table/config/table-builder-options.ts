import { Injectable } from '@angular/core';
import { TableBuilderOptions } from '../interfaces/table-builder.external';

@Injectable()
export class TableBuilderOptionsImpl implements TableBuilderOptions {
    public static readonly COUNT_SYNC_RENDERED_COLUMNS: number = 10;
    public static readonly COLUMN_RESIZE_MIN_WIDTH: number = 50;
    public static readonly SMOOTH_FPS_FRAME: number = 16;
    public static readonly FRAME_TIME: number = 66;
    public static readonly ROW_HEIGHT: number = 45;
    public static readonly TIME_IDLE: number = 200;
    public defaultValueSeparator: string = '-';
    public bufferAmount: number = 0;
    public wheelMaxDelta: number = 200;
}
