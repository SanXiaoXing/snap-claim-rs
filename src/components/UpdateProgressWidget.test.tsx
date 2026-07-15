import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateProgressWidget } from "./UpdateProgressWidget";

describe("UpdateProgressWidget", () => {
  it("下载中显示圆形百分比", () => {
    render(
      <UpdateProgressWidget
        progress={{ downloaded: 500, total: 1000 }}
        ready={false}
        onInstall={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/立即更新/)).not.toBeInTheDocument();
  });

  it("下载完成后显示勾选图标和点击安装提示", () => {
    render(
      <UpdateProgressWidget
        progress={{ downloaded: 1000, total: 1000 }}
        ready={true}
        onInstall={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.getByLabelText(/立即更新/)).toBeInTheDocument();
    expect(screen.getByText(/点击安装/)).toBeInTheDocument();
  });

  it("点击完成后的圆形控件触发 onInstall", async () => {
    const onInstall = vi.fn();
    const user = userEvent.setup();
    render(
      <UpdateProgressWidget
        progress={{ downloaded: 1000, total: 1000 }}
        ready={true}
        onInstall={onInstall}
        onDismiss={() => {}}
      />
    );

    await user.click(screen.getByLabelText(/立即更新/));

    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("点击关闭触发 onDismiss", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <UpdateProgressWidget
        progress={{ downloaded: 500, total: 1000 }}
        ready={false}
        onInstall={() => {}}
        onDismiss={onDismiss}
      />
    );

    await user.click(screen.getByLabelText(/关闭/));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
