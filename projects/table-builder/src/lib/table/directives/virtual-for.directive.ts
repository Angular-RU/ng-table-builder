import { Directive, EmbeddedViewRef, Input, OnDestroy, TemplateRef, ViewContainerRef } from '@angular/core';

import { InternalVirtualRef, TableRow, VirtualContext, VirtualIndex } from '../interfaces/table-builder.external';
import { detectChanges } from '../operators/detect-changes';

@Directive({
    selector: '[virtualFor][virtualForOf]'
})
export class VirtualForDirective implements OnDestroy {
    @Input() public virtualForDiffIndexes: number[] = [];
    @Input() public virtualForBufferOffset: number | null = null;
    private cache: Map<number, InternalVirtualRef> = new Map();
    private _source: TableRow[] = [];
    private _indexes: VirtualIndex[] = [];
    private createFrameId: number;
    private removeFrameId: number;
    private dirty: boolean = false;

    constructor(private readonly view: ViewContainerRef, private readonly template: TemplateRef<VirtualContext>) {}

    @Input()
    public set virtualForOriginSource(origin: TableRow[]) {
        if (this._source !== origin) {
            this._source = origin;
            this.dirty = true;
        }
    }

    @Input()
    public set virtualForOf(indexes: VirtualIndex[]) {
        if (!this._source || this._indexes === indexes) {
            return;
        }

        this._indexes = indexes;
        this.removeOldNodes();
        this.createNewNodes(this._indexes);
    }

    private get sourceRef(): TableRow[] {
        return this._source || [];
    }

    public ngOnDestroy(): void {
        window.cancelAnimationFrame(this.createFrameId);
        window.cancelAnimationFrame(this.removeFrameId);
        this.view.clear();
    }

    private createNewNodes(indexes: VirtualIndex[]): void {
        indexes.forEach((index: VirtualIndex): void => {
            if (this.virtualBufferIsOverloadOrNull) {
                this.createEmbeddedViewByIndex(index);
            } else {
                this.createFrameId = window.requestAnimationFrame((): void => this.createEmbeddedViewByIndex(index));
            }
        });
    }

    private createEmbeddedView(row: TableRow, index: VirtualIndex): void {
        const viewRef: EmbeddedViewRef<VirtualContext> = this.view.createEmbeddedView<VirtualContext>(this.template, {
            $implicit: row,
            virtualIndex: index,
            index: index.position
        });

        detectChanges(viewRef);
        this.cache.set(index.position, [row, viewRef]);
    }

    private createEmbeddedViewByIndex(index: VirtualIndex): void {
        const row: TableRow = this.sourceRef[index.position];
        const virtualRef: InternalVirtualRef = this.cache.get(index.position);

        if (virtualRef) {
            const [oldRow, viewRef]: InternalVirtualRef = virtualRef;
            if (row !== oldRow) {
                const stackId: number = this.view.indexOf(viewRef);
                this.view.remove(stackId);
                this.createEmbeddedView(row, index);
            }
        } else {
            this.createEmbeddedView(row, index);
        }
    }

    private removeOldNodes(): void {
        if (this.dirty) {
            this.dirty = false;
            return;
        }

        this.virtualForDiffIndexes.forEach((index: number): void => {
            if (this.virtualBufferIsOverloadOrNull) {
                this.removeEmbeddedViewByIndex(index);
            } else {
                this.removeFrameId = window.requestAnimationFrame((): void => this.removeEmbeddedViewByIndex(index));
            }
        });
    }

    private get virtualBufferIsOverloadOrNull(): boolean {
        return this.virtualForBufferOffset < 0 || !Number.isInteger(this.virtualForBufferOffset);
    }

    private removeEmbeddedViewByIndex(index: number): void {
        const ref: InternalVirtualRef | undefined = this.cache.get(index);
        if (ref) {
            const [, viewRefItem]: InternalVirtualRef = ref;
            const stackId: number = this.view.indexOf(viewRefItem);
            this.cache.delete(index);

            if (stackId > -1) {
                this.view.remove(stackId);
            }
        }
    }
}
