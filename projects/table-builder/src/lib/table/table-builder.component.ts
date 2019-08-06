import {
    AfterContentInit,
    AfterViewChecked,
    AfterViewInit,
    ApplicationRef,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    NgZone,
    OnChanges,
    OnDestroy,
    OnInit,
    SimpleChanges,
    ViewChild,
    ViewEncapsulation
} from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import {
    Fn,
    KeyMap,
    ScrollOffsetStatus,
    ScrollOverload,
    TableSimpleChanges,
    TemplateKeys
} from './interfaces/table-builder.internal';
import { TableBuilderApiImpl } from './table-builder.api';
import { NGX_ANIMATION } from './animations/fade.animation';
import { TableSchema } from './interfaces/table-builder.external';
import { NgxColumnComponent } from './components/ngx-column/ngx-column.component';
import { TemplateParserService } from './services/template-parser/template-parser.service';
import { SortableService } from './services/sortable/sortable.service';
import { SelectionService } from './services/selection/selection.service';
import { UtilsService } from './services/utils/utils.service';
import { ResizableService } from './services/resizer/resizable.service';
import { TableBuilderOptionsImpl } from './config/table-builder-options';
import { ContextMenuService } from './services/context-menu/context-menu.service';
import { FilterableService } from './services/filterable/filterable.service';
import { FilterType } from './services/filterable/filterable.interface';
import { DraggableService } from './services/draggable/draggable.service';

const { TIME_IDLE, TIME_RELOAD, FRAME_TIME }: typeof TableBuilderOptionsImpl = TableBuilderOptionsImpl;

@Component({
    selector: 'ngx-table-builder',
    templateUrl: './table-builder.component.html',
    styleUrls: ['./table-builder.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        TemplateParserService,
        SortableService,
        SelectionService,
        ResizableService,
        ContextMenuService,
        FilterableService,
        DraggableService
    ],
    encapsulation: ViewEncapsulation.None,
    animations: [NGX_ANIMATION]
})
export class TableBuilderComponent extends TableBuilderApiImpl
    implements OnChanges, OnInit, AfterContentInit, AfterViewInit, AfterViewChecked, OnDestroy {
    public dirty: boolean = true;
    public rendering: boolean = false;
    public isRendered: boolean = false;
    public contentInit: boolean = false;
    public contentCheck: boolean = false;
    public detectOverload: boolean = false;
    public showedCellByDefault: boolean = true;
    public tableViewportChecked: boolean = true;
    public scrollOffset: ScrollOffsetStatus = { offset: false };
    @ViewChild('header', { static: false })
    public headerRef: ElementRef<HTMLDivElement>;
    @ViewChild('footer', { static: false })
    public footerRef: ElementRef<HTMLDivElement>;
    private forcedRefresh: boolean = false;
    private readonly destroy$: Subject<boolean> = new Subject<boolean>();
    private checkedTaskId: number = null;
    private renderTaskId: number = null;
    private renderCount: number = 0;

    constructor(
        public readonly selection: SelectionService,
        public readonly templateParser: TemplateParserService,
        public readonly cd: ChangeDetectorRef,
        public readonly ngZone: NgZone,
        public readonly utils: UtilsService,
        public readonly resize: ResizableService,
        public readonly sortable: SortableService,
        public readonly contextMenu: ContextMenuService,
        protected readonly app: ApplicationRef,
        public readonly filterable: FilterableService,
        protected readonly draggable: DraggableService
    ) {
        super();
    }

    public get displayedColumns(): string[] {
        return (this.templateParser.schema && this.templateParser.schema.displayedColumns) || [];
    }

    public get selectionEntries(): KeyMap<boolean> {
        return this.selection.selectionModel.entries;
    }

    public get contentIsDirty(): boolean {
        return !this.contentInit && this.renderCount > 0;
    }

    public get sourceExists(): boolean {
        return !!this.source && this.source.length > 0;
    }

    private get viewIsDirty(): boolean {
        return (this.contentIsDirty || this.contentCheck) && !this.forcedRefresh;
    }

    public ngOnChanges(changes: SimpleChanges = {}): void {
        const nonIdenticalStructure: boolean = this.sourceExists && this.getCountKeys() !== this.renderedCountKeys;

        if (nonIdenticalStructure) {
            this.renderedCountKeys = this.getCountKeys();
            this.customModelColumnsKeys = this.generateCustomModelColumnsKeys();
            this.modelColumnKeys = this.generateModelColumnKeys();
            this.originalSource = this.source;
            const unDirty: boolean = !this.dirty;

            this.checkFilterValues();

            if (unDirty) {
                this.markForCheck();
            }

            const recycleView: boolean = unDirty && this.isRendered && this.contentInit;

            if (recycleView) {
                this.renderTable();
            }
        } else if (TableSimpleChanges.SOURCE_KEY in changes) {
            this.originalSource = changes[TableSimpleChanges.SOURCE_KEY].currentValue;
            this.sortAndFilter().then(() => this.reCheckDefinitions());
        }
    }

    public markForCheck(): void {
        this.contentCheck = true;
    }

    public ngOnInit(): void {
        if (this.enableSelection) {
            this.selection.primaryKey = this.primaryKey;
            this.selection.listenShiftKey();
        }
    }

    public updateScrollOffset(offset: boolean): void {
        this.scrollOffset = { offset };
        this.detectChanges();
    }

    public scrollEnd(): void {
        this.invalidateThrottleCache();
    }

    public updateScrollOverload(event: ScrollOverload): void {
        this.scrollOverload = { ...event };

        if (event.isOverload) {
            this.detectOverload = event.isOverload;
        }

        this.detectChanges();
    }

    public markVisibleColumn(column: HTMLDivElement, visible: boolean): void {
        column['visible'] = visible;
        this.detectChanges();
    }

    public ngAfterContentInit(): void {
        this.markDirtyCheck();
        this.markTemplateContentCheck();

        if (this.sourceExists) {
            this.render();
        }
    }

    public ngAfterViewInit(): void {
        this.listenTemplateChanges();
        this.listenSelectionChanges();
        this.recheckTemplateChanges();
    }

    public ngAfterViewChecked(): void {
        if (this.viewIsDirty) {
            this.viewForceRefresh();
        }
    }

    public ngOnDestroy(): void {
        this.destroy$.next(true);
        this.destroy$.unsubscribe();
    }

    public markTemplateContentCheck(): void {
        this.contentInit = !!this.source || !(this.columnTemplates && this.columnTemplates.length);
    }

    public markDirtyCheck(): void {
        this.dirty = false;
    }

    public generateColumnsKeyMap(keys: string[]): KeyMap<boolean> {
        const map: KeyMap<boolean> = {};
        keys.forEach((key: string) => (map[key] = true));
        return map;
    }

    public render(): void {
        this.contentCheck = false;
        this.ngZone.runOutsideAngular(() => {
            window.clearTimeout(this.renderTaskId);
            this.renderTaskId = window.setTimeout(() => this.renderTable(), TIME_IDLE);
        });
    }

    public renderTable(): void {
        if (!this.rendering) {
            this.rendering = true;
            const columnList: string[] = this.generateDisplayedColumns();
            const canInvalidate: boolean =
                columnList.length !== this.templateParser.schema.allRenderedColumnKeys.length;

            if (canInvalidate) {
                this.templateParser.schema.allRenderedColumnKeys = columnList;
                this.templateParser.setAllowedKeyMap(
                    this.templateParser.schema.allRenderedColumnKeys,
                    this.modelColumnKeys
                );

                const visibleColumns: string[] = this.templateParser.schema.allRenderedColumnKeys.filter(
                    (key: string) => this.schema.columnsSimpleOptions[key]
                );

                if (visibleColumns.length) {
                    this.renderCount++;
                    this.templateParser.schema.displayedColumns = [];
                    this.draw(visibleColumns, (): void => this.emitRendered());
                }
            }
        }
    }

    public toggleVisibleColumns(columnKey: string): void {
        this.templateParser.toggleColumnVisibility(columnKey);
        this.recalculateVisibleColumns();
        this.tableViewportChecked = false;
        this.changeSchema();
        this.detectChanges();

        this.ngZone.runOutsideAngular(() => {
            window.setTimeout(() => {
                this.tableViewportChecked = true;
                this.detectChanges();
                this.app.tick();
            });
        });
    }

    public resetSchema(): void {
        this.templateParser.schema.columnsSimpleOptions = {};
        this.compileTemplates(this.customModelColumnsKeys, this.modelColumnKeys);
        this.templateParser.setAllowedKeyMap(this.templateParser.schema.allRenderedColumnKeys, this.modelColumnKeys);
        this.recalculateVisibleColumns();
        this.changeSchema();
        this.detectChanges();
    }

    public recalculateVisibleColumns(): void {
        const displayedColumns: string[] = [];
        this.templateParser.schema.allRenderedColumnKeys.forEach((key: string) => {
            if (this.schema.columnsSimpleOptions[key].visible) {
                displayedColumns.push(key);
            }
        });

        this.schema.displayedColumns = displayedColumns;
    }

    private checkFilterValues(): void {
        if (this.enableFiltering) {
            this.filterable.filterType =
                this.filterable.filterType ||
                (this.columnOptions && this.columnOptions.filterType) ||
                FilterType.START_WITH;

            this.modelColumnKeys.forEach((key: string) => {
                this.filterable.filterTypeDefinition[key] =
                    this.filterable.filterTypeDefinition[key] || this.filterable.filterType;
            });
        }
    }

    private recheckTemplateChanges(): void {
        this.ngZone.runOutsideAngular(() => window.setTimeout(() => this.app.tick(), TIME_RELOAD));
    }

    private listenSelectionChanges(): void {
        if (this.enableSelection) {
            this.selection.onChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
                this.detectChanges();
                this.ngZone.runOutsideAngular(() =>
                    window.requestAnimationFrame(() => {
                        this.detectChanges();
                        this.app.tick();
                    })
                );
            });
        }
    }

    private viewForceRefresh(): void {
        this.ngZone.runOutsideAngular(() => {
            window.clearTimeout(this.checkedTaskId);
            this.checkedTaskId = window.setTimeout(() => {
                this.forcedRefresh = true;
                this.markTemplateContentCheck();
                this.render();
            }, FRAME_TIME);
        });
    }

    private listenTemplateChanges(): void {
        if (this.columnTemplates) {
            this.columnTemplates.changes.pipe(takeUntil(this.destroy$)).subscribe(() => {
                this.markForCheck();
                this.markTemplateContentCheck();
            });
        }

        if (this.contextMenuTemplate) {
            this.contextMenu.events.pipe(takeUntil(this.destroy$)).subscribe(() => this.detectChanges());
        }
    }

    private invalidateThrottleCache(): void {
        if (this.detectOverload && this.throttling) {
            this.isFrozenView = true;
            this.showedCellByDefault = false;
            this.detectChanges();
            this.ngZone.runOutsideAngular(() => {
                window.requestAnimationFrame(() => {
                    this.showedCellByDefault = true;
                    this.detectChanges();
                    window.setTimeout(() => {
                        this.isFrozenView = false;
                        this.detectChanges();
                    }, TIME_RELOAD);
                });
            });
        }

        this.detectOverload = false;
    }

    private draw(originList: string[], emitRender: Fn<void>, startIndex: number = 0): void {
        this.ngZone.runOutsideAngular(() => {
            const drawTask: Fn = (): void => {
                const columnName: string = originList[startIndex];
                this.templateParser.schema.displayedColumns.push(columnName);

                this.detectChanges();
                const isNotLastElement: boolean = startIndex + 1 !== originList.length;

                if (isNotLastElement) {
                    this.draw(originList, emitRender, startIndex + 1);
                } else {
                    emitRender();
                }
            };

            if (this.lazy) {
                window.requestAnimationFrame(() => drawTask());
            } else {
                drawTask();
            }
        });
    }

    private emitRendered(): void {
        this.isRendered = true;
        this.rendering = false;
        this.afterRendered.emit(this.isRendered);
        this.detectChanges();

        this.ngZone.runOutsideAngular(() => {
            window.setTimeout(() => this.app.tick());
        });
    }

    private generateDisplayedColumns(): string[] {
        let generatedList: string[] = [];
        const { simpleRenderedKeys, allRenderedKeys }: TemplateKeys = this.compileTemplates(
            this.customModelColumnsKeys,
            this.modelColumnKeys
        );

        if (this.keys.length) {
            generatedList = this.customModelColumnsKeys;
        } else if (simpleRenderedKeys.length) {
            generatedList = allRenderedKeys;
        } else {
            generatedList = this.modelColumnKeys;
        }

        this.checkUnCompiledTemplates(generatedList);
        return generatedList;
    }

    private compileTemplates(customModelColumnsKeys: string[], modelColumnKeys: string[]): TemplateKeys {
        const allowedKeyMap: KeyMap<boolean> = this.keys.length
            ? this.generateColumnsKeyMap(customModelColumnsKeys)
            : this.generateColumnsKeyMap(modelColumnKeys);

        this.templateParser.initialSchema(this.columnOptions).parse(allowedKeyMap, this.columnTemplates);

        return {
            allRenderedKeys: Array.from(this.templateParser.fullTemplateKeys),
            overridingRenderedKeys: Array.from(this.templateParser.overrideTemplateKeys),
            simpleRenderedKeys: Array.from(this.templateParser.templateKeys)
        };
    }

    private checkUnCompiledTemplates(generatedList: string[]): void {
        for (const key of generatedList) {
            const schema: TableSchema = this.templateParser.schema;
            const notRendered: boolean = !schema.columns[key];

            if (notRendered) {
                const column: NgxColumnComponent = new NgxColumnComponent();
                column.key = key;
                this.templateParser.compileColumnMetadata(column);
            }
        }
    }
}
