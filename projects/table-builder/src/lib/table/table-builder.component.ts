import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnChanges,
    OnInit,
    ViewEncapsulation
} from '@angular/core';

import { COL_WIDTH, ENABLE_INTERACTION_OBSERVER, ROW_HEIGHT } from '../table-builder.tokens';
import { ScrollOffsetStatus, TableRow } from '../table-builder.interfaces';
import { TableBuilderApiImpl } from './table-builder.api';
import { fadeAnimation } from './core/fade.animation';

@Component({
    selector: 'ngx-table-builder',
    templateUrl: './table-builder.component.html',
    styleUrls: ['./table-builder.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    animations: [fadeAnimation]
})
export class TableBuilderComponent extends TableBuilderApiImpl implements OnInit, OnChanges {
    public scrollOffset: ScrollOffsetStatus = { offset: false };
    public columnKeys: string[] = [];

    constructor(
        @Inject(ROW_HEIGHT) public defaultRowHeight: number,
        @Inject(COL_WIDTH) public defaultColumnWidth: number,
        @Inject(ENABLE_INTERACTION_OBSERVER) public enabledObserver: boolean,
        private cd: ChangeDetectorRef
    ) {
        super();
    }

    public get clientRowHeight(): number {
        return Number(this.rowHeight) || this.defaultRowHeight;
    }

    public get clientColWidth(): number {
        return Number(this.columnWidth) || this.defaultColumnWidth;
    }

    public get columnVirtualHeight(): number {
        return this.source.length * this.clientRowHeight;
    }

    public get columnHeight(): number {
        return this.source.length * this.clientRowHeight + this.clientRowHeight;
    }

    private get modelKeys(): string[] {
        return Object.keys(this.rowKeyValue);
    }

    private get rowKeyValue(): TableRow {
        return (this.source && this.source[0]) || {};
    }

    public ngOnChanges(): void {
        this.columnKeys = this.modelKeys.slice();
    }

    public ngOnInit(): void {
        this.columnKeys = this.modelKeys;
    }

    public updateScrollOffset(offset: boolean): void {
        this.scrollOffset = { offset };
        this.cd.detectChanges();
    }

    public inViewportAction(column: HTMLDivElement, $event: { visible: boolean }): void {
        column['visible'] = $event.visible;
    }
}
