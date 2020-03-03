import { TableRow } from '@angular-ru/ng-table-builder';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { MocksGenerator } from '../../../../helpers/utils/mocks-generator';
import { Any } from '../../../../projects/table-builder/src/lib/table/interfaces/table-builder.internal';
import { CodeDialogComponent } from '../../shared/dialog/code-dialog.component';

declare const hljs: Any;

@Component({
    selector: 'sample-six',
    templateUrl: './sample-six.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SampleSixComponent implements OnInit, AfterViewInit {
    public data: TableRow[];
    constructor(public readonly dialog: MatDialog, private readonly cd: ChangeDetectorRef) {}

    public ngOnInit(): void {
        const rows: number = 10000;
        const cols: number = 50;
        MocksGenerator.generator(rows, cols).then((data: TableRow[]) => {
            this.data = data;
            this.cd.detectChanges();
        });
    }

    public ngAfterViewInit(): void {
        document.querySelectorAll('pre code').forEach((block: Any) => {
            hljs.highlightBlock(block);
        });
    }

    public showSample(): void {
        this.dialog.open(CodeDialogComponent, {
            data: {
                title: 'Overview sortable table',
                description: '',
                code: `
<ngx-table-builder [source]="data">
    <!--
       <ngx-options /> - declaration common options for columns

       Also you can customize your columns manually
       <ngx-column key="myKey" [sortable]="'desc'">...</ngx-column>
    -->
    <ngx-options [sortable]="'asc'"></ngx-options>
</ngx-table-builder>

                `
            },
            height: '350px',
            width: '700px'
        });
    }
}
