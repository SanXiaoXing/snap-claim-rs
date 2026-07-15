import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateDialog } from "./UpdateDialog";
import type { UpdateInfo } from "../types";

describe("UpdateDialog", () => {
  const update: UpdateInfo = {
    version: "1.2.0",
    notes: "新增图片识别\n优化交通分类",
  };

  it("渲染版本号和更新内容", () => {
    render(<UpdateDialog update={update} onInstall={() => {}} onLater={() => {}} />);

    expect(screen.getByText(/1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText(/新增图片识别/)).toBeInTheDocument();
    expect(screen.getByText(/优化交通分类/)).toBeInTheDocument();
  });

  it("点击「立即更新」触发 onInstall", async () => {
    const onInstall = vi.fn();
    const user = userEvent.setup();
    render(<UpdateDialog update={update} onInstall={onInstall} onLater={() => {}} />);

    await user.click(screen.getByRole("button", { name: /立即更新/ }));

    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("点击「稍后」触发 onLater", async () => {
    const onLater = vi.fn();
    const user = userEvent.setup();
    render(<UpdateDialog update={update} onInstall={() => {}} onLater={onLater} />);

    await user.click(screen.getByRole("button", { name: /稍后/ }));

    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
