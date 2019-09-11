import { ChangeDetectorRef, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ContextMenuService } from '../../../services/context-menu/context-menu.service';
import { ContextMenuState } from '../../../services/context-menu/context-menu.interface';
import { ContextItemEvent } from '../../../interfaces/table-builder.external';
import { UtilsService } from '../../../services/utils/utils.service';
export declare class NgxContextMenuItemComponent implements OnInit, OnDestroy {
    private readonly contextMenu;
    private readonly cd;
    private readonly utils;
    private readonly ngZone;
    private static readonly MIN_PADDING;
    visible: boolean;
    contextTitle: boolean;
    disable: boolean;
    divider: boolean;
    disableSubMenu: boolean;
    subMenuWidth: number;
    onClick: EventEmitter<ContextItemEvent>;
    itemRef: ElementRef<HTMLDivElement>;
    offsetX: number;
    offsetY: number;
    private subscription;
    private taskId;
    constructor(contextMenu: ContextMenuService, cd: ChangeDetectorRef, utils: UtilsService, ngZone: NgZone);
    readonly state: Partial<ContextMenuState>;
    readonly clientRect: Partial<ClientRect | DOMRect>;
    private readonly itemElement;
    ngOnInit(): void;
    ngOnDestroy(): void;
    calculateSubMenuPosition(ref: HTMLDivElement): void;
    overflowX(): number;
    overflowY(ref: HTMLDivElement): number;
    emitClick(event: MouseEvent): void;
    private deferCloseMenu;
}
